import {ReactNode} from "react";

const Col3Layout = ({ children }: { children: ReactNode }) => {
    return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
}
Col3Layout.display = "Col1Layout";

export { Col3Layout };