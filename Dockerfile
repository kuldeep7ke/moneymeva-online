# Multi-stage: build the static export, serve it with nginx.
# Optional build args bake your own Supabase values into the image:
#   docker build --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co ...
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL=""
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=""
ARG NEXT_PUBLIC_SITE_URL=""
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npx next build

FROM nginx:1.27-alpine
LABEL org.opencontainers.image.source=https://github.com/kuldeep7ke/moneymeva-online
LABEL org.opencontainers.image.description="Money Meva — local-first personal finance app (static web build)"
COPY --from=build /app/out /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://localhost/ >/dev/null || exit 1
