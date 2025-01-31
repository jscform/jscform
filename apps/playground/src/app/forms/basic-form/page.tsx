"use client";

import { Form } from "@repo/jscform";
import testSchema from "./test.json";

export default function BasicForm() {
  
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Basic Form</h1>
        <div>
            <Form schema={testSchema} />
        </div>
      </div>
    )
  }
