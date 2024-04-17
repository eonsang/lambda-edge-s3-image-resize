import sharp, { FormatEnum } from "sharp";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type {
  Callback,
  CloudFrontResponseEvent,
  CloudFrontResponseResult,
} from "aws-lambda";
import { Readable } from "stream";
import { Context } from "vm";

const client = new S3Client({
  region: "ap-northeast-2",
});

const Bucket = "<<BUCKENT_NAME>>";

export const handler = async (
  event: CloudFrontResponseEvent,
  context: Context,
  callback: Callback<CloudFrontResponseResult>
) => {
  const { request, response } = event.Records[0].cf;
  const { uri, querystring } = request;
  const params = new URLSearchParams(querystring);
  const result: CloudFrontResponseResult = {
    status: response.status,
    statusDescription: response.statusDescription,
    headers: response.headers,
  };

  if (!querystring) return callback(null, result);

  try {
    const object = await client.send(
      new GetObjectCommand({
        Bucket,
        Key: uri.replace(/^\//, ""),
      })
    );

    if (!(object.Body instanceof Readable))
      throw new Error("object is not found.");

    const content = await object.Body.transformToString("base64");
    const image = sharp(Buffer.from(content, "base64"));

    const metadata = await image.metadata();
    const format = (params.get("f") || metadata.format) as keyof FormatEnum;
    const width =
      params.has("w") && parseInt(params.get("w")!, 10)
        ? parseInt(params.get("w")!, 10)
        : metadata.width;

    const height =
      params.has("h") && parseInt(params.get("h")!, 10)
        ? parseInt(params.get("h")!, 10)
        : null;

    const quality =
      params.has("q") && parseInt(params.get("q")!, 10)
        ? parseInt(params.get("q")!, 10)
        : 100;

    let buffer = await image
      .resize(width, height, {
        fit: "cover",
      })
      .toFormat(format, { quality })
      .toBuffer();

    let q = quality;
    while (1) {
      if (Buffer.byteLength(buffer, "base64") < 1046528) {
        break;
      }
      buffer = await image
        .resize(width, height, {
          fit: "cover",
        })
        .toFormat(format, { quality: (q -= 10) })
        .toBuffer();
    }

    result.status = "200";
    result.statusDescription = "OK";
    result.body = buffer.toString("base64");
    result.bodyEncoding = "base64";
    result.headers!["content-type"] = [
      { key: "Content-Type", value: `image/${format}` },
    ];

    return callback(null, result);
  } catch (error: any) {
    return callback(error, response);
  }
};
