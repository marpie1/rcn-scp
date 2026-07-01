FROM node:18-alpine

WORKDIR /wiki

# Install FedWiki globally
RUN npm install -g wiki

# Copy SCP plugin sources to a staging location (COPY can't use shell substitution)
COPY plugins/wiki-plugin-scp-medication /tmp/plugins/wiki-plugin-scp-medication
COPY plugins/wiki-plugin-scp-factory    /tmp/plugins/wiki-plugin-scp-factory

# Install into wiki's node_modules (global path is /usr/local/lib/node_modules on alpine)
RUN WIKI_NM=/usr/local/lib/node_modules/wiki/node_modules && \
    mkdir -p "$WIKI_NM" && \
    cp -r /tmp/plugins/wiki-plugin-scp-medication "$WIKI_NM/" && \
    cp -r /tmp/plugins/wiki-plugin-scp-factory    "$WIKI_NM/" && \
    rm -rf /tmp/plugins

# Install plugin npm deps (scp-medication has none; scp-factory is a stub — both are safe no-ops)
RUN WIKI_NM=/usr/local/lib/node_modules/wiki/node_modules && \
    cd "$WIKI_NM/wiki-plugin-scp-medication" && npm install --omit=dev 2>/dev/null || true && \
    cd "$WIKI_NM/wiki-plugin-scp-factory"    && npm install --omit=dev 2>/dev/null || true

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
