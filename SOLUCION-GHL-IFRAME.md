# Solución para Cookies en GoHighLevel Iframe

## 🔴 Problema Actual

Las cookies no se están guardando cuando la app está embebida en GHL.

## ✅ Verificaciones Necesarias

### 1. Variable de Entorno en Vercel

**CRÍTICO**: Debes tener `ALLOW_IFRAME=true` en Vercel:

1. Ve a Vercel Dashboard → Tu Proyecto → Settings → Environment Variables
2. Busca `ALLOW_IFRAME`
3. Si no existe, agrégalo con valor `true`
4. Asegúrate de que esté en **Production**, **Preview** y **Development**
5. Haz **Redeploy** después de agregarlo

### 2. Verificar en la Consola del Navegador

Después del login, ejecuta en la consola:

```javascript
// Ver Set-Cookie header de la respuesta del login
// (Esto debería mostrarse en los logs del frontend)

// Verificar cookies manualmente
document.cookie

// Verificar si session_token existe
document.cookie.includes('session_token')
```

### 3. Verificar en DevTools → Network

1. Abre DevTools → Network
2. Haz login
3. Busca la request `login`
4. Ve a la pestaña "Headers"
5. Busca "Response Headers" → `set-cookie`
6. Verifica que tenga:
   - `Secure`
   - `SameSite=None`
   - `HttpOnly`

## 🚨 Problema Común: Navegador Bloquea Cookies de Terceros

Muchos navegadores modernos bloquean cookies de terceros por defecto. Esto es especialmente común en:
- Safari (siempre)
- Chrome/Edge en modo InPrivate/Incógnito
- Chrome/Edge con configuración de privacidad estricta

### Solución Temporal para Testing

1. **Chrome/Edge**: Ve a `chrome://settings/cookies` o `edge://settings/cookies`
   - Desactiva "Bloquear cookies de terceros" temporalmente
   - O agrega una excepción para `trackerprincipal.vercel.app`

2. **Safari**: Ve a Preferencias → Privacidad
   - Desactiva "Prevenir el seguimiento entre sitios web"
   - O usa Chrome/Edge para testing

### Solución Permanente (Recomendada)

**Opción 1: Usar localStorage como fallback** (requiere cambios en el código)
- Guardar token en localStorage cuando las cookies fallan
- Leer desde localStorage en el frontend

**Opción 2: Usar dominio propio** (más complejo)
- Configurar un subdominio específico para el embed
- Usar cookies de primer nivel

## 📋 Checklist de Diagnóstico

Después del login, verifica:

- [ ] `ALLOW_IFRAME=true` está en Vercel
- [ ] El Set-Cookie header tiene `Secure` y `SameSite=None`
- [ ] La cookie aparece en DevTools → Application → Cookies
- [ ] El navegador no está bloqueando cookies de terceros
- [ ] Estás usando HTTPS (no HTTP)

## 🔍 Logs a Revisar

### En Vercel (Functions → View Logs)

Busca logs que empiecen con `[Auth]` o `[Login]`:
- Debe mostrar: `sameSite: none, secure: true`
- Debe mostrar: `Set-Cookie header generado: ...`

### En la Consola del Navegador

Busca logs que empiecen con `[Login]` o `[Frontend]`:
- Debe mostrar: `Set-Cookie header recibido: ...`
- Debe mostrar: `¿Tiene session_token en cookies? true`

## 💡 Si Nada Funciona

Si después de todas las verificaciones las cookies siguen sin guardarse, el problema es que el navegador está bloqueando cookies de terceros y no hay forma de evitarlo desde el código.

**Solución alternativa**: Implementar autenticación basada en localStorage o sessionStorage como fallback cuando las cookies no funcionan.

