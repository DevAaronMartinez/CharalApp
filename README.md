# Comunidad Salud

App móvil y API para conectar personas con enfermedades crónicas, discapacidades o síndromes. Permite compartir lo que ayuda, ver recomendaciones por condición, ubicar concentraciones de la comunidad en un mapa y encontrar clínicas/servicios útiles.

## Estructura del proyecto

```
charal3/
├── mobile/     # App Expo 54 (React Native)
└── backend/    # API Express preparada para AWS Lambda
```

## Funcionalidades

- **Comunidad**: publicar consejos y ver personas que necesitan ayuda
- **Recomendaciones**: tips personalizados por tipo de condición
- **Mapa**: concentración de usuarios + clínicas y servicios de salud
- **Perfil**: condiciones, bio, ubicación y flag "necesito ayuda"

## Requisitos

- Node.js 20+
- npm
- Expo Go (para probar en dispositivo) o simulador iOS/Android

## Inicio rápido

### 1. Backend (API local)

```bash
cd backend
npm install
npm run dev
```

La API corre en `http://localhost:3001/api`

**Cuenta demo:**
- Email: `maria@example.com`
- Contraseña: `demo123`

### 2. App móvil (Expo 54)

```bash
cd mobile
npm install
npx expo start
```

- En **iOS Simulator**: usa `http://localhost:3001`
- En **Android Emulator**: usa `http://10.0.2.2:3001`
- En **dispositivo físico**: cambia `extra.apiUrl` en `mobile/app.json` a la IP de tu máquina, ej. `http://192.168.1.10:3001`

## Despliegue serverless en AWS

El backend usa [Serverless Framework](https://www.serverless.com/) con API Gateway HTTP + Lambda + **DynamoDB** (persistencia real).

### Desplegar con un solo comando

```bash
cd backend
npm install
npm run deploy:full
```

Esto crea Lambda, API Gateway, tablas DynamoDB y carga datos demo.

**API en producción:** `https://3j3ozimwr1.execute-api.us-east-1.amazonaws.com`

Verifica con:
```bash
curl https://3j3ozimwr1.execute-api.us-east-1.amazonaws.com/api/health
# {"status":"ok","storage":"dynamodb"}
```

### Solo deploy (sin seed)

```bash
npm run deploy
npm run seed   # requiere USERS_TABLE y POSTS_TABLE en env
```

### Desarrollo local con Serverless Offline

```bash
cd backend
npm run offline
```

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Iniciar sesión |
| POST | `/api/auth/register` | Registrarse |
| GET | `/api/auth/me` | Usuario actual (requiere token) |
| GET | `/api/conditions` | Listar condiciones |
| GET | `/api/conditions/:id/recommendations` | Recomendaciones por condición |
| GET | `/api/posts` | Publicaciones de la comunidad |
| POST | `/api/posts` | Crear publicación |
| GET | `/api/users` | Usuarios (filtro por condición/needsHelp) |
| GET | `/api/users/clusters` | Concentraciones geográficas |
| GET | `/api/services` | Clínicas y servicios |
| PATCH | `/api/users/me` | Actualizar perfil |

## Condiciones incluidas (seed)

Diabetes, Fibromialgia, Autismo (TEA), Esclerosis Múltiple, Depresión Crónica, Síndrome de Down, Artritis Reumatoide, Discapacidad Visual, Discapacidad Motriz, Epilepsia.

## Notas de producción

- Usuarios y publicaciones se guardan en **DynamoDB** (`comunidad-salud-api-users-dev`, `comunidad-salud-api-posts-dev`).
- Autenticación con **JWT** (stateless, compatible con Lambda).
- Condiciones, recomendaciones y servicios siguen en seed estático (solo lectura).
- Configura `JWT_SECRET` como variable de entorno antes de deploy en producción real.

## Tecnologías

- **Mobile**: Expo SDK 54, Expo Router, React Native Maps, Expo Location
- **Backend**: Express 4, serverless-http, Serverless Framework 3
- **Cloud**: AWS Lambda + API Gateway HTTP API
