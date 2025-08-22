// src/routes/eventos/index.ts
import { Request, Response, Router } from "express";
import { ErrorResponseAPIBase } from "../../../interfaces/shared/apis/types";
import {
  RequestErrorTypes,
  SystemErrorTypes,
} from "../../../interfaces/shared/errors";

import { buscarEventosPorMes } from "../../../../core/databases/queries/RDP03/eventos/buscarEventosPorMes";
import wereObligatoryQueryParamsReceived from "../../../middlewares/wereObligatoryQueryParamsReceived";

import checkAuthentication from "../../../middlewares/checkAuthentication";
import { GetEventosSuccessResponse } from "../../../interfaces/shared/apis/eventos/types";
import isResponsableAuthenticated from "../../../middlewares/isResponsableAuthenticated";

const EventosRouter = Router();

EventosRouter.get(
  "/",
  wereObligatoryQueryParamsReceived(["Mes"]) as any,
  isResponsableAuthenticated as any,
  checkAuthentication as any,
  (async (req: Request, res: Response) => {
    try {
      const { Mes, Año } = req.query;
      // Actualizado para usar RDP03 en lugar de RDP02
      const rdp03EnUso = req.RDP03_INSTANCE!;

      // Convertir a tipos apropiados
      const mes = parseInt(Mes as string);
      const año = Año ? parseInt(Año as string) : undefined;

      // Validar mes (1-12)
      if (isNaN(mes) || mes < 1 || mes > 12) {
        return res.status(400).json({
          success: false,
          message: "El mes debe ser un número entre 1 y 12",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        } as ErrorResponseAPIBase);
      }

      // Validar año (opcional)
      if (año !== undefined && (isNaN(año) || año < 1900 || año > 2100)) {
        return res.status(400).json({
          success: false,
          message: "El año debe ser un número válido entre 1900 y 2100",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        } as ErrorResponseAPIBase);
      }

      // Buscar eventos del mes usando MongoDB
      const eventos = await buscarEventosPorMes(mes, año, rdp03EnUso);

      // Respuesta exitosa
      return res.status(200).json({
        success: true,
        message: `Se encontraron ${
          eventos.length
        } evento(s) para el mes ${mes}${año ? ` del año ${año}` : ""}`,
        data: eventos,
      } as GetEventosSuccessResponse);
    } catch (error) {
      console.error("Error al buscar eventos por mes:", error);

      return res.status(500).json({
        success: false,
        message: "Error interno del servidor al buscar eventos",
        errorType: SystemErrorTypes.UNKNOWN_ERROR,
        details: error,
      } as ErrorResponseAPIBase);
    }
  }) as any
);

export default EventosRouter;
