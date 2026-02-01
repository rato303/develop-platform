FROM pulumi/pulumi:latest

WORKDIR /app

COPY infrastructure/package.json .
RUN npm install

COPY infrastructure/ .

ENTRYPOINT ["pulumi", "up", "--yes"]
