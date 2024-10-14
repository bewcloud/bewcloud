FROM denoland/deno:ubuntu-1.46.3

EXPOSE 8000

RUN apt-get update && apt-get install -y make

WORKDIR /app

# These steps will be re-run upon each file change in your working directory:
ADD . /app

RUN rm -fr node_modules _fresh 

# Build fresh
RUN deno task build

RUN chown -R deno:deno /app /deno-dir

# Prefer not to run as root.
USER deno

# Compile the main app so that it doesn't need to be compiled each startup/entry.
RUN deno cache --reload main.ts

CMD ["run", "--allow-all", "main.ts"]
