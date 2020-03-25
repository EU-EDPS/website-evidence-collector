FROM alpine:edge

LABEL maintainer="Robert Riemann <robert.riemann@edps.europa.eu>"

# Installs latest Chromium (77) package.
RUN apk add --no-cache \
      chromium~=80.0.3987 \
      nss \
      freetype \
      freetype-dev \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      nodejs \
      yarn \
# Packages linked to testssl.sh
      bash procps drill coreutils libidn curl \
# Toolbox for advanced interactive use of WEC in container
      parallel jq grep aha

# Add user so we don't need --no-sandbox.
RUN addgroup -S collector && adduser -S -g collector -s /bin/bash collector \
    && mkdir -p /home/collector/Downloads /output \
    && chown -R collector:collector /home/collector \
    && chown -R collector:collector /output

COPY . /opt/website-evidence-collector/

# Install Testssl.sh
WORKDIR /opt/
RUN curl -SL https://github.com/drwetter/testssl.sh/archive/3.0.tar.gz | \
    tar -xz

# Run everything after as non-privileged user.
USER collector

WORKDIR /home/collector

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

RUN yarn global add file:/opt/website-evidence-collector --prefix /home/collector

# Let Puppeteer use system Chromium
ENV PUPPETEER_EXECUTABLE_PATH /usr/bin/chromium-browser

ENV PATH="/home/collector/bin:/opt/testssl.sh-3.0:${PATH}"
# Let website evidence collector run chrome without sandbox
ENV WEC_BROWSER_OPTIONS="--no-sandbox"
# Configure default command in Docker container
ENTRYPOINT ["/home/collector/bin/website-evidence-collector"]
WORKDIR /
VOLUME /output
