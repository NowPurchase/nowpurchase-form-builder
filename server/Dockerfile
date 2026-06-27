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
# (Render injects $PORT); 8080 is the local default. MCP_SHARED_SECRET MUST be
# set at deploy time — auth is OFF if it's unset.
ENV MCP_TRANSPORT=http
ENV PORT=8080
EXPOSE 8080

CMD ["node", "mcp.mjs"]
