# Despliegue web de Rutinex en Dokploy (sustituye a Vercel).
# Las VITE_* se leen al compilar: en Dokploy van como build args, no como
# variables de entorno del contenedor.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_N8N_WEBHOOK_URL
ARG VITE_N8N_TRAINER_REVIEW_WEBHOOK_URL
ARG VITE_N8N_ROUTINE_DRAFT_WEBHOOK_URL
ARG VITE_N8N_PROGRESSION_SUGGESTION_WEBHOOK_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_N8N_WEBHOOK_URL=$VITE_N8N_WEBHOOK_URL \
    VITE_N8N_TRAINER_REVIEW_WEBHOOK_URL=$VITE_N8N_TRAINER_REVIEW_WEBHOOK_URL \
    VITE_N8N_ROUTINE_DRAFT_WEBHOOK_URL=$VITE_N8N_ROUTINE_DRAFT_WEBHOOK_URL \
    VITE_N8N_PROGRESSION_SUGGESTION_WEBHOOK_URL=$VITE_N8N_PROGRESSION_SUGGESTION_WEBHOOK_URL
# Sin Supabase la app queda en blanco sin error: mejor que falle el build.
RUN test -n "$VITE_SUPABASE_URL" && test -n "$VITE_SUPABASE_ANON_KEY" && npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# Algunas imágenes llegan con permisos 600 desde el Mac; nginx no podría leerlas.
RUN chmod -R a+rX /usr/share/nginx/html
EXPOSE 80
