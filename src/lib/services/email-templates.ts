/**
 * Archivo de plantillas de correo electrónico
 * Centraliza todas las plantillas HTML para los correos electrónicos de la aplicación
 */

/**
 * Plantilla de confirmación de reserva
 */
export function getBookingConfirmationTemplate(
  bookingDetails: { 
    start_time: string | Date, 
    end_time: string | Date, 
    zoom_link?: string,
    user_name?: string
  }
) {
  const userName = bookingDetails.user_name || 'Usuario';
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: #4CAF50;">¡Tu sesión de coaching está confirmada!</h2>
      <p>Hola ${userName},</p>
      <p>Tu sesión ha sido programada correctamente:</p>
      <div style="padding: 15px; border-left: 4px solid #4CAF50; background-color: #F9F9F9; margin: 20px 0;">
        <p><strong>Fecha:</strong> ${new Date(bookingDetails.start_time).toLocaleDateString()}</p>
        <p><strong>Hora:</strong> ${new Date(bookingDetails.start_time).toLocaleTimeString()} - ${new Date(bookingDetails.end_time).toLocaleTimeString()}</p>
        ${bookingDetails.zoom_link ? `<p><strong>Enlace Zoom:</strong> <a href="${bookingDetails.zoom_link}" style="color: #4285F4;">${bookingDetails.zoom_link}</a></p>` : ''}
      </div>
      <p>Por favor, conéctate a la sesión 5 minutos antes para asegurarte de que todo funcione correctamente.</p>
      <p>Si necesitas reprogramar o cancelar tu sesión, por favor contáctanos con al menos 24 horas de anticipación.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 14px; color: #666;">¡Esperamos verte pronto!</p>
      <p style="font-size: 14px; color: #666;">El equipo de GVT Coach</p>
    </div>
  `;
}

/**
 * Plantilla de recordatorio de sesión (24 horas antes)
 */
export function getSessionReminderTemplate(
  bookingDetails: { 
    start_time: string | Date, 
    end_time: string | Date, 
    zoom_link?: string,
    user_name?: string
  }
) {
  const userName = bookingDetails.user_name || 'Usuario';
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: #FF9800;">Recordatorio: Tu sesión de coaching es mañana</h2>
      <p>Hola ${userName},</p>
      <p>Te recordamos que tu sesión de coaching está programada para mañana:</p>
      <div style="padding: 15px; border-left: 4px solid #FF9800; background-color: #F9F9F9; margin: 20px 0;">
        <p><strong>Fecha:</strong> ${new Date(bookingDetails.start_time).toLocaleDateString()}</p>
        <p><strong>Hora:</strong> ${new Date(bookingDetails.start_time).toLocaleTimeString()} - ${new Date(bookingDetails.end_time).toLocaleTimeString()}</p>
        ${bookingDetails.zoom_link ? `<p><strong>Enlace Zoom:</strong> <a href="${bookingDetails.zoom_link}" style="color: #4285F4;">${bookingDetails.zoom_link}</a></p>` : ''}
      </div>
      <p>Algunos consejos para aprovechar al máximo tu sesión:</p>
      <ul style="padding-left: 20px;">
        <li>Conéctate desde un lugar tranquilo y sin interrupciones</li>
        <li>Prepara cualquier pregunta o tema que quieras tratar</li>
        <li>Asegúrate de que tu cámara y micrófono funcionen correctamente</li>
      </ul>
      <p>¡Nos vemos mañana!</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 14px; color: #666;">El equipo de GVT Coach</p>
    </div>
  `;
}

/**
 * Plantilla de sesión cancelada
 */
export function getCancellationTemplate(
  bookingDetails: { 
    start_time: string | Date,
    user_name?: string
  }
) {
  const userName = bookingDetails.user_name || 'Usuario';
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: #F44336;">Sesión Cancelada</h2>
      <p>Hola ${userName},</p>
      <p>Tu sesión de coaching programada para el ${new Date(bookingDetails.start_time).toLocaleString()} ha sido cancelada.</p>
      <p>Si deseas reprogramar, puedes hacerlo a través de nuestra plataforma en cualquier momento.</p>
      <p>Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 14px; color: #666;">El equipo de GVT Coach</p>
    </div>
  `;
}

/**
 * Plantilla para envío de resumen de sesión
 */
export function getSessionSummaryTemplate(
  sessionDetails: {
    date: string | Date,
    summary: string,
    next_steps?: string[],
    resources?: Array<{title: string, url: string}>,
    user_name?: string
  }
) {
  const userName = sessionDetails.user_name || 'Usuario';
  const nextStepsHtml = sessionDetails.next_steps && sessionDetails.next_steps.length > 0
    ? `
      <h3 style="color: #4CAF50;">Próximos pasos</h3>
      <ul style="padding-left: 20px;">
        ${sessionDetails.next_steps.map(step => `<li>${step}</li>`).join('')}
      </ul>
    `
    : '';
  
  const resourcesHtml = sessionDetails.resources && sessionDetails.resources.length > 0
    ? `
      <h3 style="color: #4CAF50;">Recursos recomendados</h3>
      <ul style="padding-left: 20px;">
        ${sessionDetails.resources.map(resource => 
          `<li><a href="${resource.url}" style="color: #4285F4;">${resource.title}</a></li>`
        ).join('')}
      </ul>
    `
    : '';
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: #4CAF50;">Resumen de tu sesión de coaching</h2>
      <p>Hola ${userName},</p>
      <p>Gracias por asistir a nuestra sesión del ${new Date(sessionDetails.date).toLocaleDateString()}. Aquí tienes un resumen de lo que discutimos:</p>
      
      <div style="padding: 15px; border-left: 4px solid #4CAF50; background-color: #F9F9F9; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #4CAF50;">Resumen</h3>
        <p>${sessionDetails.summary}</p>
      </div>
      
      ${nextStepsHtml}
      ${resourcesHtml}
      
      <p>Si tienes alguna pregunta sobre estos puntos o necesitas aclaraciones, no dudes en contactarnos.</p>
      <p>¡Esperamos verte de nuevo pronto!</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 14px; color: #666;">El equipo de GVT Coach</p>
    </div>
  `;
} 