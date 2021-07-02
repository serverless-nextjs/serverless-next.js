import React from "react";
import { GetServerSidePropsContext } from "next";

type SSGPageProps = {
  locale?: string;
  name: string;
  preview: boolean;
};

export default function SSRPage(props: any): JSX.Element {
  return (
    <React.Fragment>
      {`Hello ${props.name}! This is an SSR Page using getServerSideProps().`}
      <div>
        <p data-cy="locale">{props.locale}</p>
        <p data-cy="preview-mode">{String(props.preview)}</p>
      </div>
    </React.Fragment>
  );
}

export function getServerSideProps(ctx: GetServerSidePropsContext): {
  props: SSGPageProps;
} {
  return {
    props: {
      locale: ctx.locale,
      name: "serverless-next.js",
      preview: !!ctx.preview
    }
  };
}
