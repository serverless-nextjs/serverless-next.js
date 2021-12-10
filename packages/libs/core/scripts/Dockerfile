# To manually update sharp_node_modules, you need docker to build sharp in Lambda Node.js 14.x environment.
# Run the following commands to build docker image, container and copy the sharp files

# docker build -t serverless-nextjs/sharp .
# CONTAINER_ID=$(docker create serverless-nextjs/sharp)
# docker cp $CONTAINER_ID:/tmp/sharp/ ./

# Now simply copy the contents of sharp/node_modules directory into sharp_node_modules
# And edit sharp_node_modules/sharp/package.json to include "build/**" and "vendor/**" files
# Otherwise NPM publish of lambda-at-edge will not copy the binaries correctly

FROM amazon/aws-lambda-nodejs:14

WORKDIR /tmp/sharp

# Update this version when upgrading
RUN npm install sharp@0.28.3

CMD ["api.handler"]
