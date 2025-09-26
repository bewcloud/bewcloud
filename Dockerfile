FROM denoland/deno:ubuntu-2.5.1

EXPOSE 8000

RUN apt-get update && apt-get install -y make

WORKDIR /app

# These steps will be re-run upon each file change in your working directory:
ADD . /app

RUN rm -fr node_modules _fresh 

# Build fresh
RUN deno task build

# Compile the main app so that it doesn't need to be compiled each startup/entry.
RUN deno cache _fresh/server.js

# Allow the crons to start
ENV START_BEWCLOUD_CRONS=true

CMD ["serve", "-A", "_fresh/server.js"]
