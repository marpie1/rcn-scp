FROM node:18-alpine

WORKDIR /wiki

# Install FedWiki globally
RUN npm install -g wiki

# Create local plugin directory inside the wiki global module
RUN mkdir -p $(npm root -g)/wiki/node_modules

# Copy SCP plugin sources
COPY plugins/wiki-plugin-scp-medication $(npm root -g)/wiki/node_modules/wiki-plugin-scp-medication
COPY plugins/wiki-plugin-scp-factory    $(npm root -g)/wiki/node_modules/wiki-plugin-scp-factory

# Install plugin dependencies (scp-medication has no npm deps; scp-factory is a stub)
RUN cd $(npm root -g)/wiki/node_modules/wiki-plugin-scp-medication && \
    [ -f package.json ] && npm install --omit=dev || true
RUN cd $(npm root -g)/wiki/node_modules/wiki-plugin-scp-factory && \
    [ -f package.json ] && npm install --omit=dev || true

# Seed pages are copied in at runtime by the entrypoint (so they can be
# placed into the mounted data volume without overwriting patient data).
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
