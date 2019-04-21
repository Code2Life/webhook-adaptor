import Debug from 'debug';
import { Context } from 'koa';
import { constants } from '../constants';
import { ExtractionSpec, RouteConfig } from '../model/route';
import { Executor, FuncSet } from './executor';

const debug = Debug('server:extract-stage');

export class ExtractStage extends Executor<boolean, RouteConfig> {

  async execute(ctx: Context): Promise<boolean> {
    // validate/filter, extract and set variables from header and body
    let result = true;
    try {
      await this.validateAndExtractProperties(ctx, this.envConf.extract.headerHandlers, constants.VERIFY_REQ_HEADER_PREFIX, ctx.request.headers);
      await this.validateAndExtractProperties(ctx, this.envConf.extract.bodyHandlers, constants.VERIFY_REQ_BODY_PREFIX, ctx.request.body);
    } catch (ex) {
      result = false;
      this.ctxRunEnv.appendError(ex);
      console.error(`Error when calling validation context ${this.envConf.name}`, ex);
    }
    debug(`${ctx.reqId}: finish request extraction`);
    return result;
  }

  async validateAndExtractProperties(ctx: Context, spec: ExtractionSpec[], funcPrefix: string, extractSourceObj: any) {
    let runtime = this.ctxRunEnv.getRunTimeEnv();
    let routeName = this.envConf.name;
    for (let handler of spec) {
      let validateObj = extractSourceObj[handler.key];
      if (handler.validate) {
        let tmpValidateFunc = (<FuncSet>runtime)[funcPrefix + routeName + handler.key];
        if (typeof tmpValidateFunc === 'function') {
          let result = await tmpValidateFunc(validateObj, ctx.request);
          if (!result) {
            throw new Error(`validation not pass for prop ${handler.key} in route ${routeName}`)  
          }
        } else {
          throw new Error(`invalid validation rule for prop ${handler.key} in route ${routeName}`)
        }
      }
      // property extracts to runtime
      this.ctxRunEnv.setPropertyToRunTime(handler.alias || handler.key, validateObj);
    }
  }
}