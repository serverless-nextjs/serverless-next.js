import React from "react";
import { GetStaticPropsContext } from "next";

type SSGPageProps = {
  name: string;
  preview: boolean;
};

export default function SSGPage(props: any): JSX.Element {
  return (
    <React.Fragment>
      {`Hello ${props.name}! This is an SSG Page using getStaticProps().`}
      <div>
        <p data-cy="preview-mode">{String(props.preview)}</p>
      </div>
    </React.Fragment>
  );
}

export async function getStaticProps(
  ctx: GetStaticPropsContext
): Promise<{ props: SSGPageProps }> {
  return {
    props: {
      name: "serverless-next.js",
      preview: !!ctx.preview
    }
  };
}
