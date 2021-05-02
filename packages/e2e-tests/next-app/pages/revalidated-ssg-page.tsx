import React from "react";
import { GetStaticPropsResult } from "next";

type SSGPageProps = {
  date: string;
};

export default function RevalidatedSSGPage(props: SSGPageProps): JSX.Element {
  return (
    <React.Fragment>
      <div>
        <p>{`The date is ${props.date}!`}</p>
      </div>
    </React.Fragment>
  );
}

export async function getStaticProps(): Promise<
  GetStaticPropsResult<SSGPageProps>
> {
  return {
    revalidate: 10,
    props: {
      date: new Date().toLocaleString()
    }
  };
}
