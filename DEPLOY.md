# Guía de Despliegue en Vercel

## 📋 Configuración por Cliente

Este dashboard está configurado para ser desplegado por cliente usando variables de entorno.

### Variables de Entorno Requeridas

Todas las variables necesarias están documentadas en `.env.example`. Copia este archivo para crear tu `.env.local`:

```bash
cp .env.example .env.local
```

Luego edita `.env.local` con los valores específicos del cliente.

### Variables Disponibles

#### Credenciales de Base de Datos (Server-side only)
- `POSTGRES_HOST`: Host de la base de datos
- `POSTGRES_PORT`: Puerto (default: 5432)
- `POSTGRES_DATABASE`: Nombre de la base de datos
- `POSTGRES_USER`: Usuario de la base de datos
- `POSTGRES_PASSWORD`: Contraseña de la base de datos

#### Configuración del Cliente (Client-side)
- `NEXT_PUBLIC_CLIENT_ID`: ID del cliente en la base de datos
- `NEXT_PUBLIC_CLIENT_TIMEZONE`: Zona horaria del cliente (ej: America/Bogota, America/Mexico_City, America/New_York)
- `NEXT_PUBLIC_CLIENT_NAME`: Nombre del cliente (opcional, para mostrar en UI)

#### APIs de IA (Server-side, opcionales pero recomendadas)
- `GEMINI_API_KEY`: Clave de Gemini (preferida para generación IA)
- `OPENAI_API_KEY`: Clave de OpenAI (fallback si Gemini falla)

## 🚀 Pasos para Desplegar en Vercel

### 1. Preparar el código
```bash
# Clonar o copiar la carpeta del proyecto para el nuevo cliente
cp -r tracker-principal tracker-cliente-nuevo
cd tracker-cliente-nuevo

# Crear y editar .env.local con la configuración del cliente
cp .env.example .env.local
nano .env.local  # o usa tu editor preferido
```

### 2. Subir a GitHub
```bash
# Inicializar git si es necesario o cambiar remote
git remote set-url origin https://github.com/tu-org/tracker-cliente-nuevo.git

# Hacer push
git add .
git commit -m "feat: configurar para Cliente Nuevo"
git push -u origin main
```

### 3. Configurar en Vercel

1. Ve a [vercel.com](https://vercel.com) y haz login
2. Click en "Add New Project"
3. Importa el repositorio de GitHub del cliente
4. En "Environment Variables", agrega **TODAS** las variables de `.env.local`:
   - `POSTGRES_HOST`
   - `POSTGRES_PORT`
   - `POSTGRES_DATABASE`
   - `POSTGRES_USER`
   - `POSTGRES_PASSWORD`
   - `NEXT_PUBLIC_CLIENT_ID`
   - `NEXT_PUBLIC_CLIENT_TIMEZONE`
   - `NEXT_PUBLIC_CLIENT_NAME`
   - `GEMINI_API_KEY`
   - `OPENAI_API_KEY`
   - `SUPERADMIN_PASS`
   - `SESSION_SECRET`
   - `WEBHOOK_FATHOM`
5. Asegúrate de marcar las variables para **Production**, **Preview** y **Development**
6. Click en "Deploy"

### 4. Verificar el despliegue

Una vez desplegado, verifica que:
- ✅ El dashboard carga correctamente
- ✅ Los datos del cliente correcto aparecen
- ✅ La zona horaria es correcta
- ✅ No hay errores en los logs de Vercel

## 🔒 Seguridad

- **NUNCA** hagas commit de archivos `.env.local` o `.env.production`
- Las credenciales de DB solo existen en:
  - Tu `.env.local` local (ignorado por git)
  - Las variables de entorno de Vercel (encriptadas)
- `.env.example` SÍ se sube a git pero sin valores sensibles

## 🔄 Actualizar Configuración

Para cambiar la configuración de un cliente ya desplegado:

1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Edita las variables necesarias
4. Redeploy desde la pestaña "Deployments" → "..." → "Redeploy"

## 📝 Zonas Horarias Comunes

- Colombia: `America/Bogota`
- México: `America/Mexico_City`
- Argentina: `America/Argentina/Buenos_Aires`
- España: `Europe/Madrid`
- USA (EST): `America/New_York`
- USA (PST): `America/Los_Angeles`

Ver lista completa: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

