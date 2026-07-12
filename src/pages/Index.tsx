import { AtlasChat } from "@/components/chat/AtlasChat";
import { Helmet } from "react-helmet";
import { useEffect, useState } from "react";
import { getTenantConfig } from "@/lib/atlas-client";
import { resolveWidgetTexts } from "@/lib/intake-machine";

const Index = () => {
  const [texts, setTexts] = useState(() => resolveWidgetTexts(undefined));

  useEffect(() => {
    getTenantConfig().then((config) => setTexts(resolveWidgetTexts(config.tenantProfile)));
  }, []);

  return (
    <>
      <Helmet>
        <title>{texts.seoTitle}</title>
        <meta name="description" content={texts.seoDescription} />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Helmet>
      
      <div className="h-screen w-screen overflow-hidden bg-background">
        {/* Full-screen chat container */}
        <div className="h-full w-full max-w-lg mx-auto shadow-chat bg-card">
          <AtlasChat />
        </div>
      </div>
    </>
  );
};

export default Index;
