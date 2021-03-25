import React from "react";
import { GetServerSidePropsContext } from "next";

type SSGPageProps = {
  name: string;
  preview: boolean;
};

export default function SSRPage(props: any): JSX.Element {
  return (
    <React.Fragment>
      {`Hello ${props.name}! This is an SSR Page using getServerSideProps().`}
      <div>
        <p data-cy="preview-mode">{String(props.preview)}</p>
      </div>
    </React.Fragment>
  );
}

export async function getServerSideProps(
  ctx: GetServerSidePropsContext
): Promise<{ props: SSGPageProps }> {
  return {
    props: {
      name: "serverless-next.js",
      preview: !!ctx.preview
    }
  };
}
