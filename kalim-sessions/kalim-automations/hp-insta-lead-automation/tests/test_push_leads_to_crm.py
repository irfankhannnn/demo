"""
Tests for scripts/push_leads_to_crm.py: row selection, payload building,
phone formatting, and the workbook write-back (in a temp file, no HTTP).

Run from the automation folder:
    python -m unittest discover -s tests -v
"""

import json
import os
import sys
import tempfile
import unittest
from unittest import mock

from openpyxl import Workbook, load_workbook

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import push_leads_to_crm as push  # noqa: E402
import upsert_leads_excel as upsert  # noqa: E402


def lead(**overrides):
    row = {col: "" for col in upsert.LEAD_COLUMNS}
    row.update({
        "lead_id": "rahul_p", "lead_name": "Rahul P",
        "instagram_link": "https://www.instagram.com/rahul_p/",
        "mobile_number": "9876543210", "lead_type": "buyer",
        "lead_score": "very_hot", "action_channel": "call",
        "property_type": "2 BHK", "locality": "Andheri West",
        "budget": "80L-1Cr", "summary": "Wants a 2 BHK, shared number.",
        "meeting_schedule": "Sat 6 Sep around 4pm",
        "meeting_datetime": "2026-09-06T16:00", "dm_can_be_closed": "no",
    })
    row.update(overrides)
    return row


class PhoneFormatting(unittest.TestCase):
    def test_prefixes_are_stripped_and_e164_applied(self):
        self.assertEqual(push.split_numbers("+91 98765 43210"), ["9876543210"])
        self.assertEqual(push.split_numbers("09876543210; 9876543210"), ["9876543210"])
        self.assertEqual(push.format_phone("9876543210"), "+919876543210")

    def test_landlines_and_junk_are_ignored(self):
        self.assertEqual(push.split_numbers("02212345678"), [])
        self.assertEqual(push.split_numbers("call me"), [])
        self.assertEqual(push.split_numbers(""), [])

    def test_first_valid_number_wins(self):
        self.assertEqual(push.split_numbers("12345; 7000000001, 8000000002"),
                         ["7000000001", "8000000002"])

    def test_mask_keeps_last_four(self):
        self.assertEqual(push.mask_phone("+919876543210"), "+91******3210")


class RowSelection(unittest.TestCase):
    def test_call_channel_with_number_is_selected(self):
        selected, skipped = push.select_rows([lead()])
        self.assertEqual(len(selected), 1)
        self.assertEqual(skipped, [])

    def test_each_signal_alone_is_enough(self):
        rows = [
            lead(lead_id="a", action_channel="dm", dm_can_be_closed="yes"),
            lead(lead_id="b", action_channel="dm", call_requested="yes"),
            lead(lead_id="c", action_channel="meeting"),
        ]
        selected, _ = push.select_rows(rows)
        self.assertEqual([r["lead_id"] for r in selected], ["a", "b", "c"])

    def test_no_signal_is_skipped(self):
        selected, skipped = push.select_rows(
            [lead(action_channel="dm", dm_can_be_closed="no", call_requested="no")])
        self.assertEqual(selected, [])
        self.assertIn("no call signal", skipped[0][1])

    def test_missing_or_invalid_number_is_skipped(self):
        _, skipped = push.select_rows([lead(mobile_number=""),
                                       lead(mobile_number="02212345678")])
        self.assertEqual([r for _, r in skipped], ["no valid mobile"] * 2)

    def test_already_pushed_and_non_leads_are_skipped(self):
        rows = [lead(lead_id="x", pushed_to_crm="yes"),
                lead(lead_id="y", lead_type="not_a_lead"),
                lead(lead_id="z", lead_type="unknown")]
        selected, skipped = push.select_rows(rows)
        self.assertEqual(selected, [])
        self.assertEqual(skipped[0], ("x", "already pushed"))
        self.assertEqual(skipped[1], ("y", "lead_type not_a_lead"))

    def test_manual_override_rows_still_push(self):
        selected, _ = push.select_rows([lead(manual_override="yes")])
        self.assertEqual(len(selected), 1)


class PayloadBuilding(unittest.TestCase):
    def test_full_payload_shape(self):
        payload = push.build_payload(lead())
        self.assertEqual(payload["name"], "Rahul P")
        self.assertEqual(payload["phone"], "+919876543210")
        self.assertEqual(payload["leadType"], "buyer")
        self.assertEqual(payload["budgetBracket"], "80L-1Cr")
        self.assertNotIn("budget", payload)
        self.assertEqual(payload["preferredArea"], "Andheri West")
        self.assertEqual(payload["source"], "Instagram")
        self.assertEqual(payload["sourceAdapter"], "insta-excel")
        self.assertEqual(payload["dedupeKey"], "insta-excel:rahul_p")
        self.assertEqual(payload["createdBy"], "Insta Excel Pipeline")
        self.assertEqual(payload["externalRef"], {
            "igUsername": "rahul_p",
            "conversationRef": "https://www.instagram.com/rahul_p/",
        })
        self.assertEqual(payload["followUp"], {
            "type": "site_visit_confirmation",
            "meetingSchedule": "Sat 6 Sep around 4pm",
            "meetingDatetime": "2026-09-06T16:00",
            "propertyHint": "2 BHK, Andheri West",
            "note": "Wants a 2 BHK, shared number.",
        })

    def test_wordy_budget_goes_as_plain_budget(self):
        payload = push.build_payload(lead(budget="around 50k rent, flexible"))
        self.assertEqual(payload["budget"], "around 50k rent, flexible")
        self.assertNotIn("budgetBracket", payload)

    def test_bracket_forms(self):
        for text in ("<50L", "1Cr+", "25L_50L", "50k-60k", "80 lakh to 1 cr", "45"):
            self.assertTrue(push.looks_like_bracket(text), text)
        for text in ("50k rent", "budget not shared", ""):
            self.assertFalse(push.looks_like_bracket(text), text)

    def test_handle_stands_in_for_missing_name(self):
        self.assertEqual(push.build_payload(lead(lead_name=""))["name"], "rahul_p")

    def test_landlord_is_filed_as_seller_with_a_note(self):
        payload = push.build_payload(lead(lead_type="landlord", summary="Has a 1 BHK."))
        self.assertEqual(payload["leadType"], "seller")
        self.assertTrue(payload["followUp"]["note"].startswith("Landlord"))
        self.assertIn("Has a 1 BHK.", payload["followUp"]["note"])

    def test_tenant_stays_tenant(self):
        self.assertEqual(push.build_payload(lead(lead_type="tenant"))["leadType"], "tenant")

    def test_note_is_truncated_to_500(self):
        payload = push.build_payload(lead(summary="x" * 900))
        self.assertEqual(len(payload["followUp"]["note"]), 500)

    def test_empty_optional_fields_are_omitted(self):
        payload = push.build_payload(lead(
            budget="", locality="", property_type="", summary="",
            meeting_schedule="", meeting_datetime=""))
        self.assertNotIn("budget", payload)
        self.assertNotIn("budgetBracket", payload)
        self.assertNotIn("preferredArea", payload)
        self.assertEqual(payload["followUp"], {"type": "site_visit_confirmation"})

    def test_meeting_datetime_fills_in_for_missing_free_text(self):
        payload = push.build_payload(lead(meeting_schedule=""))
        self.assertEqual(payload["followUp"]["meetingSchedule"], "2026-09-06T16:00")

    def test_building_name_column_is_used_when_present(self):
        payload = push.build_payload(lead(building_name="Lodha Park"))
        self.assertEqual(payload["preferredArea"], "Andheri West, Lodha Park")
        self.assertEqual(payload["followUp"]["propertyHint"],
                         "2 BHK, Andheri West, Lodha Park")


class Outcomes(unittest.TestCase):
    def test_outcome_mapping(self):
        self.assertEqual(push.outcome_for({"created": True, "leadId": "L1"})[:2], (True, "L1"))
        self.assertEqual(push.outcome_for({"updated": True, "leadId": "L2"})[:2], (True, "L2"))
        self.assertEqual(push.outcome_for({"duplicate": True, "leadId": None,
                                           "reason": "already_ingested"})[:2], (True, ""))
        self.assertEqual(push.outcome_for({"leadId": "L3", "reason": "no_new_information"})[:2],
                         (True, "L3"))
        self.assertFalse(push.outcome_for({"skipped": True, "reason": "missing_name_or_phone"})[0])
        self.assertFalse(push.outcome_for({"reason": "error"})[0])
        self.assertFalse(push.outcome_for({})[0])


class WorkbookWriteBack(unittest.TestCase):
    """End to end against a temp workbook, with the HTTP call replaced."""

    # An older workbook: written before the push columns existed.
    OLD_COLUMNS = [c for c in upsert.LEAD_COLUMNS if c not in upsert.CRM_PUSH_FIELDS]

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.workbook_path = os.path.join(self.tmp.name, "leads.xlsx")
        self.config_path = os.path.join(self.tmp.name, "crm-push.json")
        with open(self.config_path, "w", encoding="utf-8") as fh:
            json.dump({"crm_base_url": "https://crm.example/base/",
                       "tenant_id": "t-1", "adapter_api_key": "k"}, fh)
        wb = Workbook()
        wb.remove(wb.active)
        sheet = wb.create_sheet(upsert.SHEET_LEADS)
        sheet.append(self.OLD_COLUMNS)
        self.rows = [
            lead(lead_id="ready_one", manual_override="yes"),
            lead(lead_id="ready_two", lead_name="Two", mobile_number="+91 7000000002"),
            lead(lead_id="not_ready", action_channel="dm"),
        ]
        for row in self.rows:
            sheet.append([row[c] for c in self.OLD_COLUMNS])
        wb.save(self.workbook_path)

    def tearDown(self):
        self.tmp.cleanup()

    def run_main(self, results, extra=()):
        posted = []

        def fake_post(config, leads):
            posted.append((config, leads))
            return results

        with mock.patch.object(push, "post_batch", side_effect=fake_post):
            code = push.main(["--config", self.config_path,
                              "--workbook", self.workbook_path, *extra])
        return code, posted

    def test_marks_rows_adds_columns_and_logs_changes(self):
        code, posted = self.run_main([
            {"dedupeKey": "insta-excel:ready_one", "leadId": "L1", "created": True},
            {"dedupeKey": "insta-excel:ready_two", "leadId": None, "skipped": True,
             "reason": "missing_name_or_phone"},
        ])
        self.assertEqual(code, 0)
        self.assertEqual(len(posted), 1)
        config, leads = posted[0]
        self.assertEqual(config["crm_base_url"], "https://crm.example/base")
        self.assertEqual([l["dedupeKey"] for l in leads],
                         ["insta-excel:ready_one", "insta-excel:ready_two"])
        self.assertEqual(leads[1]["phone"], "+917000000002")

        wb = load_workbook(self.workbook_path)
        sheet = wb[upsert.SHEET_LEADS]
        header = [c.value for c in sheet[1]]
        self.assertEqual(header[-3:], upsert.CRM_PUSH_FIELDS)
        by_id = {}
        for raw in sheet.iter_rows(min_row=2, values_only=True):
            record = dict(zip(header, raw))
            by_id[record["lead_id"]] = record
        self.assertEqual(by_id["ready_one"]["pushed_to_crm"], "yes")
        self.assertEqual(by_id["ready_one"]["crm_lead_id"], "L1")
        self.assertTrue(by_id["ready_one"]["pushed_to_crm_at"].startswith("20"))
        self.assertEqual(by_id["ready_one"]["manual_override"], "yes")
        self.assertEqual(by_id["ready_one"]["summary"], "Wants a 2 BHK, shared number.")
        self.assertIn(by_id["ready_two"]["pushed_to_crm"], (None, ""))
        self.assertIn(by_id["not_ready"]["pushed_to_crm"], (None, ""))

        log = wb[upsert.SHEET_CHANGELOG]
        log_header = [c.value for c in log[1]]
        self.assertEqual(log_header, upsert.CHANGELOG_COLUMNS)
        entries = [dict(zip(log_header, raw)) for raw in log.iter_rows(min_row=2, values_only=True)]
        self.assertEqual([e["field"] for e in entries],
                         ["pushed_to_crm", "pushed_to_crm_at", "crm_lead_id"])
        self.assertTrue(all(e["lead_id"] == "ready_one" for e in entries))
        self.assertTrue(all(e["change_type"] == "crm_push" for e in entries))
        self.assertTrue(all(e["run_id"].startswith("push-") for e in entries))
        # openpyxl reads an empty-string cell back as None, same as the upsert sees it.
        self.assertIn(entries[0]["old_value"], (None, ""))
        self.assertEqual(entries[0]["new_value"], "yes")

        # Second run: ready_one is done, ready_two is retried, nothing else.
        code, posted = self.run_main([
            {"dedupeKey": "insta-excel:ready_two", "leadId": "L2", "created": True}])
        self.assertEqual(code, 0)
        self.assertEqual([l["dedupeKey"] for l in posted[0][1]], ["insta-excel:ready_two"])

        # Third run: nothing left, no HTTP call at all.
        code, posted = self.run_main([])
        self.assertEqual(code, 0)
        self.assertEqual(posted, [])

    def test_dry_run_posts_and_writes_nothing(self):
        before = os.path.getmtime(self.workbook_path)
        code, posted = self.run_main([], extra=["--dry-run"])
        self.assertEqual(code, 0)
        self.assertEqual(posted, [])
        self.assertEqual(os.path.getmtime(self.workbook_path), before)
        header = [c.value for c in load_workbook(self.workbook_path)[upsert.SHEET_LEADS][1]]
        self.assertNotIn("pushed_to_crm", header)

    def test_http_failure_exits_4_without_marking(self):
        with mock.patch.object(push, "post_batch", side_effect=RuntimeError("HTTP 500")):
            with self.assertRaises(SystemExit) as ctx:
                push.main(["--config", self.config_path, "--workbook", self.workbook_path])
        self.assertEqual(ctx.exception.code, 4)
        header = [c.value for c in load_workbook(self.workbook_path)[upsert.SHEET_LEADS][1]]
        self.assertNotIn("pushed_to_crm", header)

    def test_missing_config_exits_2(self):
        with self.assertRaises(SystemExit) as ctx:
            push.main(["--config", os.path.join(self.tmp.name, "nope.json"),
                       "--workbook", self.workbook_path])
        self.assertEqual(ctx.exception.code, 2)


class HttpLayer(unittest.TestCase):
    def test_headers_body_and_retry(self):
        calls = []

        class Response:
            def __init__(self, body):
                self.body = body

            def read(self):
                return self.body

            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

        def opener(request, timeout):
            calls.append((request, timeout))
            if len(calls) == 1:
                raise OSError("connection reset")
            return Response(b'{"ok": true, "results": [{"dedupeKey": "insta-excel:a"}]}')

        config = {"crm_base_url": "https://crm.example", "tenant_id": "t-1",
                  "adapter_api_key": "secret", "adapter_name": "insta-excel"}
        results = push.post_batch(config, [{"dedupeKey": "insta-excel:a"}], opener=opener)
        self.assertEqual(results, [{"dedupeKey": "insta-excel:a"}])
        self.assertEqual(len(calls), 2)
        request, timeout = calls[-1]
        self.assertEqual(timeout, 20)
        self.assertEqual(request.full_url, "https://crm.example/api/internal/adapters/leads")
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(request.get_header("X-api-key"), "secret")
        self.assertEqual(request.get_header("X-tenant-id"), "t-1")
        self.assertEqual(request.get_header("X-adapter"), "insta-excel")
        self.assertEqual(json.loads(request.data), {"leads": [{"dedupeKey": "insta-excel:a"}]})

    def test_gives_up_after_second_failure(self):
        def opener(request, timeout):
            raise OSError("down")
        config = {"crm_base_url": "https://crm.example", "tenant_id": "t",
                  "adapter_api_key": "k", "adapter_name": "insta-excel"}
        with self.assertRaises(RuntimeError):
            push.post_batch(config, [{}], opener=opener)


class UpsertContract(unittest.TestCase):
    """The two analyst fields the push relies on are validated and persisted."""

    def test_new_columns_sit_after_meeting_schedule(self):
        cols = upsert.LEAD_COLUMNS
        i = cols.index("meeting_schedule")
        self.assertEqual(cols[i + 1:i + 3], ["call_requested", "meeting_datetime"])
        self.assertEqual(cols[-3:], ["pushed_to_crm", "pushed_to_crm_at", "crm_lead_id"])
        for field in ("call_requested", "meeting_datetime"):
            self.assertIn(field, upsert.ANALYST_FIELDS)
            self.assertIn(field, upsert.LOCKED_FIELDS)

    def test_validation_rejects_bad_values(self):
        parsed = {"leads": [{"lead_id": "a"}]}
        good = {"lead_id": "a", "summary": "s", "call_requested": "yes",
                "meeting_datetime": "2026-09-06T16:00"}
        upsert.validate_analysis({"leads": [good]}, parsed)   # no exit
        for bad in ({"call_requested": "maybe"}, {"meeting_datetime": "6 Sep 4pm"}):
            entry = dict(good, **bad)
            with self.assertRaises(SystemExit) as ctx:
                with mock.patch("sys.stderr"):
                    upsert.validate_analysis({"leads": [entry]}, parsed)
            self.assertEqual(ctx.exception.code, 2)

    def test_meeting_datetime_counts_as_a_meeting_for_closability(self):
        row = {"mobile_number": "9876543210", "requirement_complete": "yes",
               "meeting_schedule": "", "meeting_datetime": "2026-09-06T16:00",
               "action_channel": "call"}
        self.assertEqual(upsert.compute_closability(row)[0], "yes")


if __name__ == "__main__":
    unittest.main()
