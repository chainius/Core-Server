FROM node:8.5.0

RUN mkdir -p /var/core-server
RUN mkdir -p /var/www

#--------------------------------------------------------------------------------------

COPY ./ /var/core-server
RUN cd /var/core-server/src && npm install && /var/core-server/core-server --install

WORKDIR /var/www

#--------------------------------------------------------------------------------------

CMD /var/core-server/core-server /var/www --production
EXPOSE 80
EXPOSE 443