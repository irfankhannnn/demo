#!/usr/bin/env python3
"""Split apigw-explicit-routes.yaml into two nested stacks (<500 resources each)."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "apigw-explicit-routes.yaml"
PART1 = ROOT / "apigw-explicit-routes-part1.yaml"
PART2 = ROOT / "apigw-explicit-routes-part2.yaml"

HEADER = """AWSTemplateFormatVersion: "2010-09-09"
Description: >
  API Gateway resources (split stack). Explicit methods for stable/core endpoints;
  catch-all proxy under /api handles ad-hoc routes without manual CFN edits.

Parameters:
  RestApiId:
    Type: String
  RootResourceId:
    Type: String
  LambdaFunctionArn:
    Type: String
  AllowOrigin:
    Type: String
    Default: "*"
  AllowHeaders:
    Type: String
    Default: "Content-Type,Authorization,X-Requested-With,x-tenant-id"
  AllowMethods:
    Type: String
    Default: "GET,POST,PUT,PATCH,DELETE,OPTIONS"
"""

PART2_EXTRA_PARAMS_HEADER = ""


def parse_resources(text: str) -> tuple[str, dict[str, str]]:
    match = re.search(r"^Parameters:\n", text, re.M)
    if not match:
        raise SystemExit("Parameters section not found")
    resources_match = re.search(r"^Resources:\n", text, re.M)
    if not resources_match:
        raise SystemExit("Resources section not found")

    prefix = text[: resources_match.end()]
    resources_text = text[resources_match.end() :]

    blocks: dict[str, str] = {}
    for m in re.finditer(r"^  ([A-Za-z][A-Za-z0-9]*):\n", resources_text, re.M):
        name = m.group(1)
        start = m.start()
        next_m = re.search(r"^  [A-Za-z][A-Za-z0-9]*:\n", resources_text[m.end() :], re.M)
        end = m.end() + next_m.start() if next_m else len(resources_text)
        blocks[name] = resources_text[start:end]

    return prefix, blocks


def refs_in_block(block: str) -> set[str]:
    refs = set(re.findall(r"!Ref ([A-Za-z][A-Za-z0-9]*)", block))
    refs.update(re.findall(r"!GetAtt ([A-Za-z][A-Za-z0-9]*)", block))
    return refs


def rewrite_refs(block: str, mapping: dict[str, str]) -> str:
    for old, new in sorted(mapping.items(), key=lambda item: len(item[0]), reverse=True):
        block = block.replace(f"!Ref {old}", f"!Ref {new}")
        block = block.replace(f"!GetAtt {old}", f"!GetAtt {new}")
    return block


def build_part_files(part1_names: list[str], part2_names: list[str], blocks: dict[str, str]) -> None:
    part1_set = set(part1_names)
    part2_set = set(part2_names)

    part2_refs = set()
    for name in part2_names:
        part2_refs.update(refs_in_block(blocks[name]))
    cross_refs = sorted(ref for ref in part2_refs if ref in part1_set)

    extra_params = ""
    for ref in cross_refs:
        extra_params += f"  {ref}Id:\n    Type: String\n"

    part1_resources = "".join(blocks[name] for name in part1_names)
    part1_outputs = "\nOutputs:\n"
    for ref in cross_refs:
        part1_outputs += f"  {ref}Id:\n    Value: !Ref {ref}\n"

    ref_mapping = {ref: f"{ref}Id" for ref in cross_refs}
    part2_resources = ""
    for name in part2_names:
        part2_resources += rewrite_refs(blocks[name], ref_mapping)

    part1_text = HEADER + "\nResources:\n\n" + part1_resources + part1_outputs
    part2_text = (
        HEADER
        + (extra_params if extra_params else "")
        + "\nResources:\n\n"
        + part2_resources
    )

    PART1.write_text(part1_text, encoding="utf-8")
    PART2.write_text(part2_text, encoding="utf-8")

    print(f"Part 1 resources: {len(part1_names)} -> {PART1.name}")
    print(f"Part 2 resources: {len(part2_names)} -> {PART2.name}")
    print(f"Cross-stack parameter refs: {len(cross_refs)}")


def main() -> None:
    text = SOURCE.read_text(encoding="utf-8")
    _, blocks = parse_resources(text)
    names = list(blocks.keys())

    # Keep core proxy + first half of explicit routes in part 1.
    split_at = 260
    must_stay = {"ApiResource", "ApiProxyResource", "ApiProxyAnyMethod"}
    part1_names = names[:split_at]
    part2_names = names[split_at:]

    for required in must_stay:
        if required in part2_names:
            part2_names.remove(required)
            if required not in part1_names:
                part1_names.insert(0, required)

    build_part_files(part1_names, part2_names, blocks)


if __name__ == "__main__":
    main()
