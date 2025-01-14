/*
 * @Description: 
 * @Usage: 
 * @Author: richen
 * @Date: 2021-11-19 00:24:43
 * @LastEditTime: 2024-11-11 00:01:48
*/
import { KoattyContext } from "koatty_core";
import { Exception } from "koatty_exception";
import { DefaultLogger as Logger } from "koatty_logger";
import { Span, Tags } from "opentracing";
import { inspect } from "util";
import { catcher, extensionOptions } from "../catcher";

/**
 * wsHandler
 *
 * @param {Koatty} app
 * @returns {*}  
 */
export async function wsHandler(ctx: KoattyContext, next: Function, ext?: extensionOptions): Promise<any> {
  const timeout = ext.timeout || 10000;
  // Encoding
  ctx.encoding = ext.encoding;
  // auto send security header
  ctx.set('X-Powered-By', 'Koatty');
  ctx.set('X-Content-Type-Options', 'nosniff');
  ctx.set('X-XSS-Protection', '1;mode=block');

  const span = <Span>ext.span;
  if (span) {
    span.setTag(Tags.HTTP_URL, ctx.originalUrl);
    span.setTag(Tags.HTTP_METHOD, ctx.method);
  }


  // after send message event
  const finish = () => {
    const now = Date.now();
    const msg = `{"action":"${ctx.protocol}","status":"${ctx.status}","startTime":"${ctx.startTime}","duration":"${(now - ctx.startTime) || 0}","requestId":"${ctx.requestId}","endTime":"${now}","path":"${ctx.originalPath || '/'}"}`;
    Logger[(ctx.status >= 400 ? 'Error' : 'Info')](msg);
    if (span) {
      span.setTag(Tags.HTTP_STATUS_CODE, ctx.status);
      span.setTag(Tags.HTTP_METHOD, ctx.method);
      span.setTag(Tags.HTTP_URL, ctx.url);
      span.log({ "request": msg });
      span.finish();
    }
    // ctx = null;
  }
  ctx?.res?.once("finish", finish);

  // ctx.websocket.once("error", finish);
  // ctx.websocket.once("connection", () => {
  //     Logger.Info("websocket connected");
  // });
  // ctx.websocket.once("close", (socket: any, code: number, reason: Buffer) => {
  //     Logger.Error("websocket closed: ", Helper.toString(reason));
  // });

  // try /catch
  const response: any = ctx.res;
  try {
    if (!ext.terminated) {
      response.timeout = null;
      // promise.race
      await Promise.race([new Promise((resolve, reject) => {
        response.timeout = setTimeout(reject, timeout, new Exception('Request Timeout', 1, 408));
        return;
      }), next()]);
    }

    if (ctx.body !== undefined && ctx.status === 404) {
      ctx.status = 200;
    }
    if (ctx.status >= 400) {
      throw new Exception(ctx.message, 1, ctx.status);
    }
    ctx.websocket.send(inspect(ctx.body || ''), null);
    return null;
  } catch (err: any) {
    return catcher(ctx, err, span, ext.globalErrorHandler, ext);
  } finally {
    ctx.res.emit("finish");
    clearTimeout(response.timeout);
  }

}

