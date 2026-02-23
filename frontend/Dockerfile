# Build stage
FROM node:20-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build argument for API URL (set during build on Railway)
# Now uses same-origin /api path since nginx proxies to the backend
ARG REACT_APP_API_URL=/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL

# Build the app
RUN npm run build


# Production stage - serve with nginx
FROM nginx:alpine

# Remove default nginx config
RUN rm -f /etc/nginx/conf.d/default.conf

# Copy nginx config template (uses __PLACEHOLDER__ syntax, not $VAR)
COPY nginx.conf.template /etc/nginx/nginx.conf.template

# Copy custom entrypoint that substitutes env vars into nginx config
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy built files
COPY --from=builder /app/build /usr/share/nginx/html

# Railway provides PORT env var
ENV PORT=80

EXPOSE ${PORT}

ENTRYPOINT ["/docker-entrypoint.sh"]
