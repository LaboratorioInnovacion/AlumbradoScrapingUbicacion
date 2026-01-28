const fs = require('fs');
const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

function createGoogleMapsLink(latitud, longitud) {
  if (!latitud || !longitud) return '';
  return `https://www.google.com/maps/search/?api=1&query=${latitud},${longitud}`;
}

function processIncidentData(jsonData) {
  const incidentes = jsonData.result.incidentes || [];
  
  return incidentes.map(incidente => ({
    id: incidente.id,
    fechaAlta: incidente.fechaAlta,
    observaciones: incidente.observaciones,
    direccion: incidente.direccion,
    barrio: incidente.barrio,
    localidad: incidente.localidad,
    provincia: incidente.provincia,
    latitud: incidente.latitud,
    longitud: incidente.longitud,
    googleMapsLink: createGoogleMapsLink(incidente.latitud, incidente.longitud),
    estado: incidente.estado.descripcion,
    prioridad: incidente.prioridad.descripcion,
    tipoIncidente: incidente.tipoIncidente.descripcion,
    areaServicio: incidente.areaServicio.descripcion,
    nroOrden: incidente.nroOrden
  }));
}

async function sendToGoogleSheets(data, spreadsheetId, range) {
  const auth = new GoogleAuth({
    keyFile: 'credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  const headers = [
    'ID', 'Fecha Alta', 'Observaciones', 'Dirección', 'Barrio', 
    'Localidad', 'Provincia', 'Latitud', 'Longitud', 'Google Maps Link',
    'Estado', 'Prioridad', 'Tipo Incidente', 'Área Servicio', 'N° Orden'
  ];

  const rows = data.map(item => [
    item.id,
    item.fechaAlta,
    item.observaciones,
    item.direccion,
    item.barrio,
    item.localidad,
    item.provincia,
    item.latitud,
    item.longitud,
    item.googleMapsLink,
    item.estado,
    item.prioridad,
    item.tipoIncidente,
    item.areaServicio,
    item.nroOrden
  ]);

  const body = {
    values: [headers, ...rows]
  };

  try {
    const result = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: body
    });
    
    console.log(`Se actualizaron ${result.data.updatedRows} filas en Google Sheets`);
    return result;
  } catch (error) {
    console.error('Error al enviar a Google Sheets:', error);
    throw error;
  }
}

async function processAndSend(jsonFilePath, spreadsheetId, range = 'Sheet1!A1') {
  try {
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    const processedData = processIncidentData(jsonData);
    
    console.log(`Procesados ${processedData.length} incidentes`);
    
    await sendToGoogleSheets(processedData, spreadsheetId, range);
    
    console.log('Proceso completado exitosamente');
  } catch (error) {
    console.error('Error en el proceso:', error);
    throw error;
  }
}

module.exports = {
  createGoogleMapsLink,
  processIncidentData,
  sendToGoogleSheets,
  processAndSend
};