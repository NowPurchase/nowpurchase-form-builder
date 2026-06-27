# Minimal image for the remote (HTTP) MCP server.
#
# It ships ONLY the self-contained bundle (dist/mcp.mjs) — no repo, no
# node_modules. Build the bundle first, then build this image with the
# `server/` directory as the build context:
#
#   npm run mcp:bundle
#   docker build -f server/Dockerfile -t formengine-mcp:latest server/
#
FROM node:20-alpine
WORKDIR /app

# the one generated artifact (run `npm run mcp:bundle` to produce it)
COPY dist/mcp.mjs ./mcp.mjs

# HTTP transport for remote use (claude.ai). PORT is provided by the host
# (Render injects $PORT); 8080 is the local default.
#
# Auth is OAuth 2.1 (what claude.ai connectors use). Set at deploy time:
#   MCP_AUTH_PASSWORD  password users enter in the OAuth login screen
#                      (falls back to MCP_SHARED_SECRET; login gate OFF if both unset)
#   MCP_SHARED_SECRET  optional static bearer also accepted (tests/scripts)
#   MCP_PUBLIC_URL     public https origin for OAuth metadata. On Render this is
#                      auto-detected from RENDER_EXTERNAL_URL, so it's optional.
#   PREVIEW_BASE_URL   base for preview/save links (defaults to http://localhost:5173)
#   DLMS_API_BASE      DLMS backend origin; enables the save_form tool
#   DLMS_SERVICE_KEY   bearer the server sends on draft writes (server-to-server)
ENV MCP_TRANSPORT=http
ENV PORT=8080
EXPOSE 8080

CMD ["node", "mcp.mjs"]
