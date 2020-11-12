import React from "react";
import { GetStaticPropsContext } from "next";
import Image from "next/image";

type ImageComponentProps = {
  name: string;
};

export default function ImageComponentPage(props: any): JSX.Element {
  return (
    <React.Fragment>
      {`Hello ${props.name}! This is an SSG Page using getStaticProps() and with the new Image component.`}
      <Image
        src="/app-store-badge.png"
        alt="Appstore"
        width={564}
        height={168}
      />
    </React.Fragment>
  );
}

export async function getStaticProps(
  ctx: GetStaticPropsContext
): Promise<{ props: ImageComponentProps }> {
  return {
    props: { name: "serverless-next.js" }
  };
}
