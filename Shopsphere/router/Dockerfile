FROM nginx:1.27-alpine
COPY default.conf /etc/nginx/conf.d/default.conf
COPY route-blue.conf /etc/nginx/route-blue.conf
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh
CMD ["/entrypoint.sh"]
