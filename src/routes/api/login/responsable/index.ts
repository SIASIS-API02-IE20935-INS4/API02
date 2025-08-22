// src/routes/auth/login/responsable/index.ts - Migrado a MongoDB
import { Request, Response, Router } from "express";
import { generateResponsableToken } from "../../../../lib/helpers/functions/jwt/generators/responsableToken";
import { verifyResponsablePassword } from "../../../../lib/helpers/encriptations/responsable.encriptation";
import { RolesSistema } from "../../../../interfaces/shared/RolesSistema";
import { ResponseSuccessLogin } from "../../../../interfaces/shared/apis/shared/login/types";
import { AuthBlockedDetails } from "../../../../interfaces/shared/errors/details/AuthBloquedDetails";
import { verificarBloqueoRolResponsable } from "../../../../../core/databases/queries/RDP03/bloqueo-roles/verificarBloqueoRolResponsable";
import { buscarResponsablePorNombreUsuario } from "../../../../../core/databases/queries/RDP03/responsables/buscarResponsablePorNombreUsuario";

const router = Router();

export interface LoginBody {
  Nombre_Usuario: string;
  Contraseña: string;
}

router.get("/", (async (req: Request, res: Response) => {
  return res.json({ message: "Login Responsable" });
}) as any);

// Ruta de login para Responsables (Padres/Apoderados) - Usando MongoDB
router.post("/", (async (req: Request, res: Response) => {
  try {
    const { Nombre_Usuario, Contraseña }: LoginBody = req.body;

    // Validar que se proporcionen ambos campos
    if (!Nombre_Usuario || !Contraseña) {
      return res.status(400).json({
        success: false,
        message: "El nombre de usuario y la contraseña son obligatorios",
      });
    }

    // Verificar si el rol de responsable está bloqueado (usando MongoDB)
    try {
      const bloqueoRol = await verificarBloqueoRolResponsable();

      if (bloqueoRol) {
        const tiempoActual = Math.floor(Date.now() / 1000);
        const timestampDesbloqueo = Number(bloqueoRol.Timestamp_Desbloqueo);

        // Determinamos si es un bloqueo permanente (timestamp = 0 o en el pasado)
        const esBloqueoPermanente =
          timestampDesbloqueo <= 0 || timestampDesbloqueo <= tiempoActual;

        // Calculamos el tiempo restante solo si NO es un bloqueo permanente
        let tiempoRestante = "Permanente";
        let fechaFormateada = "No definida";

        if (!esBloqueoPermanente) {
          const tiempoRestanteSegundos = timestampDesbloqueo - tiempoActual;
          const horasRestantes = Math.floor(tiempoRestanteSegundos / 3600);
          const minutosRestantes = Math.floor(
            (tiempoRestanteSegundos % 3600) / 60
          );
          tiempoRestante = `${horasRestantes}h ${minutosRestantes}m`;

          // Formatear fecha de desbloqueo
          const fechaDesbloqueo = new Date(timestampDesbloqueo * 1000);
          fechaFormateada = fechaDesbloqueo.toLocaleString("es-ES", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
        }

        const errorDetails: AuthBlockedDetails = {
          tiempoActualUTC: tiempoActual,
          timestampDesbloqueoUTC: timestampDesbloqueo,
          tiempoRestante: tiempoRestante,
          fechaDesbloqueo: fechaFormateada,
          esBloqueoPermanente: esBloqueoPermanente,
        };

        return res.status(403).json({
          success: false,
          message: esBloqueoPermanente
            ? "El acceso para responsables está permanentemente bloqueado"
            : "El acceso para responsables está temporalmente bloqueado",
          details: errorDetails,
        });
      }
    } catch (error) {
      console.error("Error al verificar bloqueo de rol:", error);
      // No bloqueamos el inicio de sesión por errores en la verificación
    }

    // Buscar el responsable por nombre de usuario (usando MongoDB)
    const responsable = await buscarResponsablePorNombreUsuario(Nombre_Usuario);

    // Si no existe el responsable o las credenciales son incorrectas, retornar error
    if (!responsable) {
      return res.status(401).json({
        success: false,
        message: "Credenciales inválidas",
      });
    }

    // Verificar la contraseña
    const isContraseñaValid = verifyResponsablePassword(
      Contraseña,
      responsable.Contraseña
    );

    if (!isContraseñaValid) {
      return res.status(401).json({
        success: false,
        message: "Credenciales inválidas",
      });
    }

    // Generar token JWT
    const token = generateResponsableToken(
      responsable.Id_Responsable,
      responsable.Nombre_Usuario
    );

    const response: ResponseSuccessLogin = {
      success: true,
      message: "Inicio de sesión exitoso",
      data: {
        Apellidos: responsable.Apellidos,
        Nombres: responsable.Nombres,
        Rol: RolesSistema.Responsable,
        token,
        Google_Drive_Foto_ID: responsable.Google_Drive_Foto_ID,
      },
    };

    // Responder con el token y datos básicos del usuario
    return res.status(200).json(response);
  } catch (error) {
    console.error("Error en inicio de sesión:", error);
    return res.status(500).json({
      success: false,
      message: "Error en el servidor, por favor intente más tarde",
    });
  }
}) as any);

export default router;
