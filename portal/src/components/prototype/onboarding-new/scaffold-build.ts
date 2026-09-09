export type ScaffoldBuildMethodId =
  | "java-maven-docker"
  | "java-gradle-docker"
  | "node-npm-docker"
  | "python-pip-docker"
  | "dockerfile";

type ScaffoldBuildMethod = {
  id: ScaffoldBuildMethodId;
  label: string;
  hint: string;
  command: string;
};

const maven: ScaffoldBuildMethod = {
  id: "java-maven-docker",
  label: "Java / Maven + Docker",
  hint: "Maven package → Docker image",
  command: "./mvnw -B package && docker build -t service:preview .",
};

export const scaffoldBuildMethods: ScaffoldBuildMethod[] = [
  maven,
  {
    id: "java-gradle-docker",
    label: "Java / Gradle + Docker",
    hint: "Gradle build → Docker image",
    command: "./gradlew build && docker build -t service:preview .",
  },
  {
    id: "node-npm-docker",
    label: "Node.js / npm + Docker",
    hint: "npm install and build → Docker image",
    command: "npm ci && npm run build --if-present && docker build -t service:preview .",
  },
  {
    id: "python-pip-docker",
    label: "Python / pip + Docker",
    hint: "Install dependencies → Docker image",
    command: "python -m pip install -r requirements.txt && docker build -t service:preview .",
  },
  {
    id: "dockerfile",
    label: "Existing Dockerfile",
    hint: "Build directly from your Dockerfile",
    command: "docker build -t service:preview .",
  },
];

export function getScaffoldBuildMethod(value: unknown): ScaffoldBuildMethod {
  return scaffoldBuildMethods.find((method) => method.id === value) ?? maven;
}
