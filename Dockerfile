FROM node:7.8.0

RUN mkdir -p /var/core-server
RUN mkdir -p /var/www

#--------------------------------------------------------------------------------------

COPY ./ /var/core-server
RUN cd /var/core-server/src && npm install && /var/core-server/core-server --install

WORKDIR /var/www
RUN ln -s /var/core-server/core-server /usr/bin/core-server

#--------------------------------------------------------------------------------------

CMD /var/core-server/core-server /var/www --production
EXPOSE 8085
EXPOSE 443