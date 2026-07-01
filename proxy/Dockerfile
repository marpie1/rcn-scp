FROM python:3.12-slim

WORKDIR /app

COPY sofi-proxy.py .

# Override the wiki pages path for Docker (uses the shared volume)
ENV WIKI_DATA_DIR=/wiki-data

EXPOSE 8765

CMD ["python3", "sofi-proxy.py"]
