FROM node:11.10.1

#--------------------------------------------------------------------------------------

WORKDIR /var/www
CMD core-server /var/www --production
EXPOSE 8080
EXPOSE 443

#--------------------------------------------------------------------------------------

COPY ./ /var/core-server
RUN mkdir -p /var/www && \
    rm -rf /var/core-server/node_modules /var/core-server/src/plugins/*/node_modules && \
    ln -s /var/core-server/core-server /usr/bin/core-server && \
    cd /var/core-server && npm install