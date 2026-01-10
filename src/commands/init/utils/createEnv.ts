import { InitOptions } from "../utils";
import fs from "fs";
import path from "path";

export const createEnv = ({ projectName }: InitOptions, env?: string) => {
  const fileName = env ? `.env.${env}` : ".env";
  const projectPath = path.resolve(process.cwd(), projectName);
  const filePath = path.join(projectPath, fileName);

  const content = `
SSH_PUBLIC_KEY=xxxxxx
SSH_PRIVATE_KEY=xxxxxx
`;
  fs.writeFileSync(filePath, content);
};
