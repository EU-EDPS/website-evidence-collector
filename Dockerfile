FROM alpine:edge

LABEL maintainer="Robert Riemann <robert.riemann@edps.europa.eu>"

# Installs latest Chromium (77) package.
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      freetype-dev \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      nodejs \
      yarn \
# Packages linked to testssl.sh
      bash procps drill coreutils libidn curl

# Add user so we don't need --no-sandbox.
RUN addgroup -S collector && adduser -S -g collector -s /bin/bash collector \
    && mkdir -p /home/collector/Downloads \
    && chown -R collector:collector /home/collector

# Run everything after as non-privileged user.
USER collector

# Install Testssl.sh
WORKDIR /home/collector
RUN curl -Lo testssh.sh.tar.gz https://github.com/drwetter/testssl.sh/archive/3.0.tar.gz \
    && tar -xf testssh.sh.tar.gz
ENV PATH="/home/collector/testssl.sh-3.0:${PATH}"

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

# Puppeteer v1.19.0 works with Chromium 77.
RUN yarn global add \
    https://github.com/EU-EDPS/website-evidence-collector/tarball/master \
    --prefix /home/collector

# Let Puppeteer use system Chromium
ENV PUPPETEER_EXECUTABLE_PATH /usr/bin/chromium-browser


# Configure default command in Docker container
ENTRYPOINT ["/home/collector/bin/website-evidence-collector"]
