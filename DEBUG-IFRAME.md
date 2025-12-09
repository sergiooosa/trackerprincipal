# Scripts de Debugging para Iframe en GoHighLevel

## 🔍 Comandos para ejecutar en la Consola del Navegador

Abre la consola del navegador (F12 → Console) y ejecuta estos comandos uno por uno:

### 1. Verificar cookies guardadas
```javascript
// Ver todas las cookies del dominio
document.cookie

// Ver cookie de sesión específica
document.cookie.split(';').find(c => c.includes('session_token'))
```

### 2. Verificar si está en iframe
```javascript
// Debe retornar true si está en iframe
window.self !== window.top

// Ver información del iframe
console.log('En iframe:', window.self !== window.top);
console.log('Parent origin:', window.parent.location.origin);
console.log('Current origin:', window.location.origin);
```

### 3. Probar login manualmente
```javascript
// Hacer login y ver respuesta
fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ clave: 'TU_CLAVE_AQUI', remember: false }),
  credentials: 'include'
})
.then(r => {
  console.log('Status:', r.status);
  console.log('Headers:', [...r.headers.entries()]);
  return r.json();
})
.then(data => {
  console.log('Response:', data);
  // Verificar cookies después
  console.log('Cookies después:', document.cookie);
})
.catch(e => console.error('Error:', e));
```

### 4. Verificar sesión actual
```javascript
// Llamar a /api/auth/me
fetch('/api/auth/me', {
  credentials: 'include'
})
.then(r => {
  console.log('Status:', r.status);
  console.log('Cookies enviadas:', document.cookie);
  return r.json();
})
.then(data => {
  console.log('Usuario actual:', data);
})
.catch(e => console.error('Error:', e));
```

### 5. Ver headers de todas las requests
```javascript
// Interceptar fetch para ver headers
const originalFetch = window.fetch;
window.fetch = function(...args) {
  console.log('Fetch llamado:', args[0]);
  if (args[1]) {
    console.log('Options:', args[1]);
    console.log('Credentials:', args[1].credentials);
  }
  return originalFetch.apply(this, args).then(r => {
    console.log('Response status:', r.status);
    console.log('Response headers:', [...r.headers.entries()]);
    return r;
  });
};
```

### 6. Verificar configuración de cookies
```javascript
// Ver todas las cookies con detalles
document.cookie.split(';').forEach(cookie => {
  const [name, value] = cookie.trim().split('=');
  console.log(`Cookie: ${name} = ${value?.substring(0, 20)}...`);
});

// Verificar si session_token existe
const hasSession = document.cookie.includes('session_token');
console.log('¿Tiene cookie de sesión?', hasSession);
```

### 7. Forzar refresh de React Query
```javascript
// Si estás usando React Query, forzar refresh
// (Solo funciona si tienes acceso al queryClient)
// En la consola del componente:
window.__REACT_QUERY_CLIENT__?.invalidateQueries({ queryKey: ['me'] });
```

### 8. Verificar SameSite y Secure de cookies
```javascript
// Esto requiere ver las cookies en DevTools → Application → Cookies
// Pero puedes verificar si se están enviando:
fetch('/api/auth/me', {
  credentials: 'include'
}).then(r => {
  // Ver Set-Cookie header en la respuesta
  console.log('Set-Cookie header:', r.headers.get('set-cookie'));
});
```

## 📋 Checklist de Diagnóstico

1. ✅ ¿Las cookies se están guardando?
   - Ejecuta comando #1
   - Debe mostrar `session_token=...`

2. ✅ ¿Está en iframe?
   - Ejecuta comando #2
   - Debe retornar `true`

3. ✅ ¿El login funciona?
   - Ejecuta comando #3
   - Debe retornar `{ ok: true, user: {...} }`
   - Y debe aparecer la cookie después

4. ✅ ¿La sesión se mantiene?
   - Ejecuta comando #4
   - Debe retornar `{ user: {...} }` (no `{ user: null }`)

5. ✅ ¿Las requests incluyen cookies?
   - Ejecuta comando #5
   - Debe mostrar `credentials: 'include'` en todas las requests

## 🐛 Problemas Comunes

### Problema: Cookies no se guardan
**Solución**: Verificar que:
- `ALLOW_IFRAME=true` está en Vercel
- El sitio está en HTTPS (no HTTP)
- Las cookies tienen `sameSite: "none"` y `secure: true`

### Problema: Cookies se guardan pero no se envían
**Solución**: 
- Agregar `credentials: "include"` a todos los fetch
- Verificar que no haya CORS bloqueando

### Problema: Login funciona pero UI no actualiza
**Solución**:
- Verificar que React Query está invalidando correctamente
- Verificar que el componente está re-renderizando

## 📸 Información para Compartir

Si necesitas ayuda, comparte:
1. Resultado del comando #1 (cookies)
2. Resultado del comando #2 (iframe)
3. Resultado del comando #3 (login)
4. Resultado del comando #4 (sesión)
5. Screenshot de DevTools → Application → Cookies
6. Screenshot de DevTools → Network → Headers de `/api/auth/me`

