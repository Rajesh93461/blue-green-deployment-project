FROM node:20-alpine
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
# APP_VERSION decides attributes, options and layout: 1.0 = Blue, 2.0 = Green
ARG APP_VERSION=1.0
ENV APP_VERSION=$APP_VERSION
EXPOSE 3000
CMD ["node", "server.js"]
