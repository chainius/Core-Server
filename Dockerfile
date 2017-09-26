FROM node:7.8.0

RUN mkdir -p /var/core-server
RUN mkdir -p /var/www

#--------------------------------------------------------------------------------------

WORKDIR /var/www
CMD core-server /var/www --production
EXPOSE 80
EXPOSE 443

#--------------------------------------------------------------------------------------

COPY ./ /var/core-server
RUN ln -s /var/core-server/core-server /usr/bin/core-server
RUN cd /var/core-server/src && npm install && core-server --install