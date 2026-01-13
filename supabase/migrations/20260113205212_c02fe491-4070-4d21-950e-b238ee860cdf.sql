-- Add DELETE and UPDATE policies for partners table
CREATE POLICY "Users can delete partners for own formations"
ON public.partners
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM company_formations cf
    WHERE cf.id = partners.company_formation_id
    AND cf.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update partners for own formations"
ON public.partners
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM company_formations cf
    WHERE cf.id = partners.company_formation_id
    AND cf.user_id = auth.uid()
  )
);

-- Add DELETE and UPDATE policies for documents table
CREATE POLICY "Users can delete documents for own formations"
ON public.documents
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM company_formations cf
    WHERE cf.id = documents.company_formation_id
    AND cf.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update documents for own formations"
ON public.documents
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM company_formations cf
    WHERE cf.id = documents.company_formation_id
    AND cf.user_id = auth.uid()
  )
);