#!/usr/bin/env python3
"""Patch mcp-remote 0.1.37 to work with AWS API Gateway stage URLs.

API Gateway remaps the WWW-Authenticate header to x-amzn-remapped-www-authenticate
and uses stage paths like /dev/. mcp-remote's defaults don't handle either case.
Run this after every `npm install -g mcp-remote`.
"""
import re
from pathlib import Path

PATH = Path(r"C:\Users\zishan\AppData\Roaming\npm\node_modules\mcp-remote\dist\chunk-65X3S4HB.js")


def patch_www_auth_fallback(s: str) -> str:
    """Make WWW-Authenticate extraction fall back to the API-Gateway-remapped header."""
    old = 'const authenticateHeader = res.headers.get("WWW-Authenticate");'
    new = 'const authenticateHeader = res.headers.get("WWW-Authenticate") || res.headers.get("x-amzn-remapped-www-authenticate") || res.headers.get("x-amzn-Remapped-www-authenticate");'
    assert old in s, "extractWWWAuthenticateParams pattern not found"
    return s.replace(old, new)


def patch_field_fallback(s: str) -> str:
    """Make field extraction from WWW-Authenticate also use the remapped header."""
    old = 'const wwwAuthHeader = response.headers.get("WWW-Authenticate");'
    new = 'const wwwAuthHeader = response.headers.get("WWW-Authenticate") || response.headers.get("x-amzn-remapped-www-authenticate") || response.headers.get("x-amzn-Remapped-www-authenticate");'
    assert old in s, "extractFieldFromWwwAuth pattern not found"
    return s.replace(old, new)


def patch_discovery_urls(s: str) -> str:
    """For stage URLs like /dev, try /dev/.well-known/... first."""
    old = """  let pathname = url2.pathname;
  if (pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  urlsToTry.push({
    url: new URL(`/.well-known/oauth-authorization-server${pathname}`, url2.origin),
    type: "oauth"
  });
  urlsToTry.push({
    url: new URL(`/.well-known/openid-configuration${pathname}`, url2.origin),
    type: "oidc"
  });
  urlsToTry.push({
    url: new URL(`${pathname}/.well-known/openid-configuration`, url2.origin),
    type: "oidc"
  });
  return urlsToTry;"""
    new = """  let pathname = url2.pathname;
  if (pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  urlsToTry.push({
    url: new URL(`${pathname}/.well-known/oauth-authorization-server`, url2.origin),
    type: "oauth"
  });
  urlsToTry.push({
    url: new URL(`/.well-known/oauth-authorization-server${pathname}`, url2.origin),
    type: "oauth"
  });
  urlsToTry.push({
    url: new URL(`${pathname}/.well-known/openid-configuration`, url2.origin),
    type: "oidc"
  });
  urlsToTry.push({
    url: new URL(`/.well-known/openid-configuration${pathname}`, url2.origin),
    type: "oidc"
  });
  return urlsToTry;"""
    assert old in s, "buildDiscoveryUrls pattern not found"
    return s.replace(old, new)


def patch_http_transport_ctor(s: str) -> str:
    """Preserve protected resource metadata URL when a new transport is created."""
    old = """    this._url = url2;
    this._resourceMetadataUrl = void 0;
    this._scope = void 0;
    this._requestInit = opts?.requestInit;
    this._authProvider = opts?.authProvider;
    this._fetchWithInit = createFetchWithInit(opts?.fetch, opts?.requestInit);"""
    new = """    this._url = url2;
    const prm = opts?.authProvider?.protectedResourceMetadata;
    this._resourceMetadataUrl = prm?.resource ? new URL(`.well-known/oauth-protected-resource`, `${prm.resource}/`) : void 0;
    this._scope = void 0;
    this._requestInit = opts?.requestInit;
    this._authProvider = opts?.authProvider;
    this._fetchWithInit = createFetchWithInit(opts?.fetch, opts?.requestInit);"""
    assert old in s, "StreamableHTTPClientTransport ctor pattern not found"
    return s.replace(old, new)


def patch_sse_transport_ctor(s: str) -> str:
    """Preserve protected resource metadata URL for SSE transport too."""
    old = """  constructor(url2, opts) {
    this._url = url2;
    this._resourceMetadataUrl = void 0;
    this._scope = void 0;
    this._eventSourceInit = opts?.eventSourceInit;
    this._requestInit = opts?.requestInit;
    this._authProvider = opts?.authProvider;
    this._fetch = opts?.fetch;
    this._fetchWithInit = createFetchWithInit(opts?.fetch, opts?.requestInit);
  }"""
    new = """  constructor(url2, opts) {
    this._url = url2;
    const prm = opts?.authProvider?.protectedResourceMetadata;
    this._resourceMetadataUrl = prm?.resource ? new URL(`.well-known/oauth-protected-resource`, `${prm.resource}/`) : void 0;
    this._scope = void 0;
    this._eventSourceInit = opts?.eventSourceInit;
    this._requestInit = opts?.requestInit;
    this._authProvider = opts?.authProvider;
    this._fetch = opts?.fetch;
    this._fetchWithInit = createFetchWithInit(opts?.fetch, opts?.requestInit);
  }"""
    assert old in s, "SSEClientTransport ctor pattern not found"
    return s.replace(old, new)


def main():
    s = PATH.read_text(encoding="utf-8")
    s = patch_www_auth_fallback(s)
    s = patch_field_fallback(s)
    s = patch_discovery_urls(s)
    s = patch_http_transport_ctor(s)
    s = patch_sse_transport_ctor(s)
    PATH.write_text(s, encoding="utf-8")
    print(f"Patched {PATH}")


if __name__ == "__main__":
    main()
