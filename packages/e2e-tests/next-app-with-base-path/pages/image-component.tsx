import React from "react";
import Image from "next/image";

type ImageComponentProps = {
  name: string;
};

export default function ImageComponentPage(
  props: ImageComponentProps
): JSX.Element {
  return (
    <React.Fragment>
      {`Hello ${props.name}! This is an SSG Page using getStaticProps() and with the new Image component.`}
      <Image
        src="/basepath/app-store-badge.png"
        alt="Appstore"
        width={564}
        height={168}
      />
    </React.Fragment>
  );
}

export async function getStaticProps(): Promise<{
  props: ImageComponentProps;
}> {
  return {
    props: { name: "serverless-next.js" }
  };
}
