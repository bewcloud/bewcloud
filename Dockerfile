FROM denoland/deno:ubuntu-2.5.1

EXPOSE 8000

RUN apt-get update && apt-get install -y make

WORKDIR /app

COPY . .
RUN deno task build
RUN deno cache _fresh/server.js

# Allow the crons to start
ENV START_BEWCLOUD_CRONS=true

CMD ["serve", "-A", "_fresh/server.js"]
