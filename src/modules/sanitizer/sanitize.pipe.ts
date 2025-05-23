import { PipeTransform, Injectable, ArgumentMetadata } from "@nestjs/common";
import * as sanitizeHtml from 'sanitize-html';

@Injectable()
export class SanitizePipe implements PipeTransform {
    transform(value: any, metadata: ArgumentMetadata) {
        if(typeof value === 'string') {
            return sanitizeHtml(value, {
                allowedTags: [],
                allowedAttributes: {},
            }).trim();
        }

        if(typeof value === 'object' && value !== null) {
            Object.keys(value).forEach((key) => {
                value[key] = sanitizeHtml(value[key], {
                    allowedTags: [],
                    allowedAttributes: {},
                }).trim();
            })
        };

        return value;
    }
}