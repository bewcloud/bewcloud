FROM denoland/deno:ubuntu-2.5.1

EXPOSE 8000

RUN apt-get update && apt-get install -y make

WORKDIR /app

# Prepare for any npm modules required "on the fly"
RUN mkdir -p /app/node_modules/.deno

RUN chown -R deno:deno /app

# Prefer not to run as root.
USER deno

# These steps will be re-run upon each file change in your working directory:
ADD . /app

# Compile the main app so that it doesn't need to be compiled each startup/entry.
RUN deno cache --reload main.ts

CMD ["run", "--allow-all", "main.ts"]
