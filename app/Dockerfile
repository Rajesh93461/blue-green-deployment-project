FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py test_app.py ./
# BROKEN=1 builds a deliberately faulty version (used to demo failed health check)
ARG BROKEN=0
ENV BROKEN=$BROKEN
EXPOSE 5000
CMD ["gunicorn", "-b", "0.0.0.0:5000", "app:app"]
