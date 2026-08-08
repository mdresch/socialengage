FROM python:3.14-slim

WORKDIR /app

COPY requirements.txt ./requirements.txt
COPY main.py ./main.py

RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

EXPOSE 8088

CMD ["python", "main.py"]
