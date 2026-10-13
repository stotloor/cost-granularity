FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY apexapp ./apexapp
ENV APEX_DB=/data/data.db APEX_UPLOAD_DIR=/data/uploads
VOLUME ["/data"]
EXPOSE 8000
CMD ["uvicorn", "apexapp.main:app", "--host", "0.0.0.0", "--port", "8000"]
