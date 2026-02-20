FROM denoland/deno:ubuntu-2.6.10

EXPOSE 8000

RUN apt-get update && apt-get install -y make zip coreutils

WORKDIR /app

ADD . /app

# Prepare for any npm modules required "on the fly"
RUN mkdir -p /app/node_modules/.deno

RUN chown -R deno:deno /app

# Prefer not to run as root.
USER deno

# Build frontend components and CSS
RUN deno task build

# Compile the main app so that it doesn't need to be compiled each startup/entry.
RUN deno cache --reload main.ts

CMD ["task", "preview"]
